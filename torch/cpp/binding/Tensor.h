#include <napi.h>

#include <torch/torch.h>
#include <string>

enum EXArrayType
{
    FLOAT,
    INTEGER,
    DOUBLE
};

class Tensor : public Napi::ObjectWrap<Tensor<T>>
{
public:
    Tensor(const Napi::CallbackInfo &);

    Napi::Value Shape(const Napi::CallbackInfo &);

    Napi::Value ToArray(const Napi::CallbackInfo &);

    EXArrayType GetType();

    static Napi::Function GetClass(Napi::Env);

    torch::Tensor tensor();
    std::string type;
};
